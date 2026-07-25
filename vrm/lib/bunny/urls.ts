/**
 * Bunny player URLs, derived from the library ID and the video GUID.
 *
 * Both are pure string builders, deliberately NOT "server-only": the review card
 * and the player both need them, and neither needs a secret to work them out.
 *
 * There is a third URL -- the HLS playlist on the CDN (see playbackUrl in
 * ./client) -- and it is the one you must NOT put in front of a human. It 403s
 * when opened directly, and Chrome and Firefox cannot play an .m3u8 without a
 * player library anyway. It is a machine URL, for the player to consume.
 */

/** The player, for embedding in a page. */
export function bunnyEmbedUrl(libraryId: string, videoGuid: string): string {
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?autoplay=false&preload=false`;
}

/**
 * A shareable page that plays the video. This is "the URL of the video" for anyone
 * who wants to open, send, or check one.
 *
 * Available the moment the video record exists, because it is just the library ID
 * and the GUID. It does NOT wait on the encode webhook the way the stored
 * video_url does -- during encoding the page simply says so.
 */
export function bunnyPlayUrl(libraryId: string, videoGuid: string): string {
  return `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}`;
}
