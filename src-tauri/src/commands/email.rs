//! E-Mail bridge — read `.eml` and `.msg` files into one normalised shape.
//!
//! A single command, [`read_email`], dispatches on the file extension:
//!
//! * `.eml` (RFC822) → parsed with the `mail-parser` crate.
//! * `.msg` (Outlook OLE Compound Document) → parsed with the `msg_parser`
//!   crate.
//!
//! Both paths are normalised to [`EmailContent`], whose camelCase serialisation
//! the Angular frontend depends on. Parsing never panics — any failure surfaces
//! as [`CommandError::EmailParse`].

use std::path::PathBuf;

use serde::Serialize;

use super::recipe_book::CommandError;

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailAttachment {
    pub name: String,
    pub mime: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct EmailContent {
    pub from: String,
    pub to: Vec<String>,
    pub subject: String,
    pub date: String,
    pub html_body: Option<String>,
    pub text_body: Option<String>,
    pub attachments: Vec<EmailAttachment>,
}

#[tauri::command]
pub fn read_email(path: String) -> Result<EmailContent, CommandError> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(CommandError::NotFound(path));
    }
    if !p.is_file() {
        return Err(CommandError::NotAFile(path));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "eml" => read_eml(&p),
        "msg" => read_msg(&p),
        // Mirror the other commands: anything we can't read is "not markdown".
        _ => Err(CommandError::NotMarkdown(path)),
    }
}

/// Build a `"Name <addr>"` label from the optional parts, degrading gracefully
/// to just the name, just the address, or an empty string.
fn address_label(name: Option<&str>, addr: Option<&str>) -> String {
    let name = name.map(str::trim).filter(|s| !s.is_empty());
    let addr = addr.map(str::trim).filter(|s| !s.is_empty());
    match (name, addr) {
        (Some(n), Some(a)) => format!("{n} <{a}>"),
        (Some(n), None) => n.to_string(),
        (None, Some(a)) => a.to_string(),
        (None, None) => String::new(),
    }
}

// ---------- .eml (mail-parser) ----------

fn read_eml(p: &std::path::Path) -> Result<EmailContent, CommandError> {
    use mail_parser::{Address, MessageParser, MimeHeaders};

    let bytes = std::fs::read(p)?;
    let msg = MessageParser::default()
        .parse(&bytes)
        .ok_or_else(|| CommandError::EmailParse("Konnte E-Mail nicht parsen".to_string()))?;

    // From: take the first address, formatted as "Name <addr>".
    let from = msg
        .from()
        .and_then(|a| a.first())
        .map(|addr| address_label(addr.name(), addr.address()))
        .unwrap_or_default();

    // To: every address in the header.
    let to: Vec<String> = match msg.to() {
        Some(Address::List(list)) => list
            .iter()
            .map(|a| address_label(a.name(), a.address()))
            .filter(|s| !s.is_empty())
            .collect(),
        Some(group @ Address::Group(_)) => group
            .iter()
            .map(|a| address_label(a.name(), a.address()))
            .filter(|s| !s.is_empty())
            .collect(),
        None => Vec::new(),
    };

    let subject = msg.subject().unwrap_or_default().to_string();
    let date = msg.date().map(|d| d.to_rfc3339()).unwrap_or_default();

    let html_body = msg.body_html(0).map(|c| c.into_owned());
    let text_body = msg.body_text(0).map(|c| c.into_owned());

    let attachments = msg
        .attachments()
        .map(|part| {
            let name = part.attachment_name().unwrap_or("").to_string();
            let mime = part
                .content_type()
                .map(|ct| match ct.subtype() {
                    Some(sub) => format!("{}/{}", ct.ctype(), sub),
                    None => ct.ctype().to_string(),
                })
                .unwrap_or_default();
            EmailAttachment {
                name,
                mime,
                size: part.len() as u64,
            }
        })
        .collect();

    Ok(EmailContent {
        from,
        to,
        subject,
        date,
        html_body,
        text_body,
        attachments,
    })
}

// ---------- .msg (msg_parser) ----------

fn read_msg(p: &std::path::Path) -> Result<EmailContent, CommandError> {
    use msg_parser::Outlook;

    let outlook = Outlook::from_path(p.to_string_lossy().as_ref())
        .map_err(|e| CommandError::EmailParse(format!("{e:?}")))?;

    let from = address_label(
        non_empty(&outlook.sender.name),
        non_empty(&outlook.sender.email),
    );

    let to: Vec<String> = outlook
        .to
        .iter()
        .map(|person| address_label(non_empty(&person.name), non_empty(&person.email)))
        .filter(|s| !s.is_empty())
        .collect();

    let subject = outlook.subject.clone();

    // Prefer the dedicated delivery-time field; fall back to the Date header.
    let date = if !outlook.message_delivery_time.is_empty() {
        outlook.message_delivery_time.clone()
    } else {
        outlook.headers.date.clone()
    };

    let html_body = non_empty(&outlook.html).map(|s| s.to_string());
    let text_body = non_empty(&outlook.body).map(|s| s.to_string());

    let attachments = outlook
        .attachments
        .iter()
        .map(|att| {
            // Prefer the full original filename, then the 8.3 name, then the
            // display name.
            let name = non_empty(&att.long_file_name)
                .or_else(|| non_empty(&att.file_name))
                .or_else(|| non_empty(&att.display_name))
                .unwrap_or("")
                .to_string();
            EmailAttachment {
                name,
                mime: att.mime_tag.clone(),
                size: att.payload_bytes.len() as u64,
            }
        })
        .collect();

    Ok(EmailContent {
        from,
        to,
        subject,
        date,
        html_body,
        text_body,
        attachments,
    })
}

/// `Some(trimmed)` when the string has non-whitespace content, else `None`.
fn non_empty(s: &str) -> Option<&str> {
    let t = s.trim();
    if t.is_empty() {
        None
    } else {
        Some(t)
    }
}

#[cfg(test)]
mod tests {
    use super::{address_label, read_email};
    use std::fs;

    #[test]
    fn address_label_formats_all_shapes() {
        assert_eq!(
            address_label(Some("Jane"), Some("jane@example.com")),
            "Jane <jane@example.com>"
        );
        assert_eq!(address_label(Some("Jane"), None), "Jane");
        assert_eq!(address_label(None, Some("jane@example.com")), "jane@example.com");
        assert_eq!(address_label(None, None), "");
        // Whitespace-only is treated as absent.
        assert_eq!(address_label(Some("  "), Some("a@b")), "a@b");
    }

    #[test]
    fn parses_a_simple_eml() {
        let dir = std::env::temp_dir().join("hopsmd_test_email_eml");
        let _ = fs::create_dir_all(&dir);
        let f = dir.join("simple.eml");
        let raw = "From: Jane Doe <jane@example.com>\r\n\
                   To: John Smith <john@example.com>\r\n\
                   Subject: Hallo Welt\r\n\
                   Date: Mon, 9 Jun 2025 10:30:00 +0000\r\n\
                   Content-Type: text/plain; charset=utf-8\r\n\
                   \r\n\
                   This is the body text.\r\n";
        fs::write(&f, raw).unwrap();

        let out = read_email(f.to_string_lossy().into_owned()).unwrap();
        assert_eq!(out.subject, "Hallo Welt");
        assert!(
            out.from.contains("jane@example.com"),
            "from was {:?}",
            out.from
        );
        assert_eq!(out.to.len(), 1, "to was {:?}", out.to);
        assert!(
            out.text_body
                .as_deref()
                .unwrap_or_default()
                .contains("This is the body text."),
            "text_body was {:?}",
            out.text_body
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn unknown_extension_errors() {
        let dir = std::env::temp_dir().join("hopsmd_test_email_unknown");
        let _ = fs::create_dir_all(&dir);
        let f = dir.join("image.png");
        fs::write(&f, b"not really a png").unwrap();

        assert!(read_email(f.to_string_lossy().into_owned()).is_err());

        let _ = fs::remove_dir_all(&dir);
    }
}
