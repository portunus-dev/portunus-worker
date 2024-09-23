async function generateOTP(secret, timePeriodOffset = 0) {
    // Get the current time
    const time = Math.floor(Date.now() / 1000)
  
    // Calculate the time period with the offset
    const timePeriod = Math.floor(time / 30) + timePeriodOffset;

    const timeBuffer = new ArrayBuffer(8);
    (new DataView(timeBuffer)).setBigUint64(0, BigInt(timePeriod), false);

  
    // Create a key from the secret
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
  
    // Sign the time buffer with the key
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, timeBuffer)
    const signature = new Uint8Array(signatureBuffer)
  
    // Take the last 4 bits of the signature
    const offset = signature[signature.length - 1] & 0xf
  
    // Take 4 bytes from the signature starting at the offset
    const otp = (signature[offset] & 0x7f) << 24 |
      (signature[offset + 1] & 0xff) << 16 |
      (signature[offset + 2] & 0xff) << 8 |
      (signature[offset + 3] & 0xff)
  
    // Take the last 6 digits of the otp
    const otpStr = (otp % 1000000).toString().padStart(6, '0')
  
    return otpStr
  }
  
  async function verifyOTP(otp, secret) {
    // Check the OTP for the current time period and the previous and next time periods
    const otps = [
        await generateOTP(secret, -1),
        await generateOTP(secret, 0),
        await generateOTP(secret, 1)
    ];

    return otps.includes(otp);
}
  
module.exports = { generateOTP, verifyOTP };
