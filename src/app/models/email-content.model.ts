/**
 * Payload returned by the Rust `read_email` command.
 * Shape mirrors the camelCase serde output of `EmailContent` in `commands/`.
 */
export interface EmailAttachment {
  readonly name: string;
  readonly mime: string;
  readonly size: number;
}

export interface EmailContent {
  readonly from: string;
  readonly to: string[];
  readonly subject: string;
  readonly date: string;
  readonly htmlBody: string | null;
  readonly textBody: string | null;
  readonly attachments: EmailAttachment[];
}
