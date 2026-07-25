/**
 * Something you can read out over the phone without spelling it.
 *
 * Shared by both places a tenant gets created -- the video app's New Tenant dialog
 * and the scraper's Create Widget modal -- so the password you read to a client is
 * the same shape whichever screen you happened to be on.
 */
export function suggestPassword(): string {
  const words = ["solar", "copper", "anvil", "harbour", "cedar", "quarry", "lantern", "granite"];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${word}-${Math.floor(1000 + Math.random() * 9000)}`;
}
