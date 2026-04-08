const { URL } = require('url');
const ipRangeCheck = require('ip-range-check');

/**
 * Validates if a URL is safe to fetch from the server.
 * Blocks private/internal IP ranges and reserved addresses.
 * @param {string} urlString 
 * @returns {boolean}
 */
function isSafeUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    const host = parsedUrl.hostname;

    // List of private/reserved IP ranges
    const privateRanges = [
      '127.0.0.0/8',    // IPv4 loopback
      '10.0.0.0/8',     // RFC1918
      '172.16.0.0/12',  // RFC1918
      '192.168.0.0/16', // RFC1918
      '169.254.0.0/16', // IPv4 link-local
      '0.0.0.0/8',      // Local network
      '::1/128',        // IPv6 loopback
      'fe80::/10',      // IPv6 link-local
      'fc00::/7',       // IPv6 unique local addr
      '::ffff:0:0/96'   // IPv4-mapped IPv6
    ];

    // Simple check: if hostname is an IP, check against ranges
    // If it's a domain, we'd ideally resolve it, but at minimum we block known local strings
    const localHostnames = ['localhost', 'internal', 'metadata.google.internal', '169.254.169.254'];
    if (localHostnames.some(h => host.toLowerCase().includes(h))) {
      return false;
    }

    // Attempt to check if host is an IP address
    const isIp = require('net').isIP(host);
    if (isIp && ipRangeCheck(host, privateRanges)) {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { isSafeUrl };
