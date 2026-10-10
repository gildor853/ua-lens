// Forward-confirmed reverse DNS check for a request that claims to be a crawler.
// Usage: node examples/verify-dns.mjs <ip> "<user agent>"
//   node examples/verify-dns.mjs 66.249.66.1 "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
// Performs real DNS lookups through node:dns; ua-lens itself never touches the network.
import { promises as dns } from "node:dns";
import { detectBot, verifyBotDns } from "ua-lens";

const [ip, ua] = process.argv.slice(2);
if (ip === undefined || ua === undefined) {
  console.error('usage: node examples/verify-dns.mjs <ip> "<user agent>"');
  process.exit(2);
}

const resolvers = {
  reverse: (address) => dns.reverse(address),
  forward: async (host) => {
    const [v4, v6] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    return [...(v4.status === "fulfilled" ? v4.value : []), ...(v6.status === "fulfilled" ? v6.value : [])];
  },
};

const bot = detectBot(ua);
const result = await verifyBotDns(ip, bot, resolvers);
console.log(`${bot.name ?? "unknown agent"} from ${ip}: ${result.verified ? "verified" : "NOT verified"} (${result.reason}${result.hostname ? `, ${result.hostname}` : ""})`);
