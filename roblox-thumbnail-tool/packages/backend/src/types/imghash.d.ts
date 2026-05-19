declare module 'imghash' {
  /**
   * Calculate perceptual hash of an image.
   * @param filepath Path to the image file, or Buffer containing the image data.
   * @param bits Length of the hash (default is 8).
   * @param format Output format, 'hex' or 'binary' (default is 'hex').
   */
  export function hash(filepath: string | Buffer, bits?: number, format?: 'hex' | 'binary'): Promise<string>;
}
