// Server-side validation for user-supplied Custom OpenAI-compatible provider URLs.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AIError } from './types';
function isPrivateIPv4(ip: string): boolean { const p=ip.split('.').map(Number); if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255)) return true; const [a,b]=p; return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===198&&(b===18||b===19))||a>=224; }
function isPrivateIPv6(ip: string): boolean { const n=ip.toLowerCase(); return n==='::'||n==='::1'||n.startsWith('fc')||n.startsWith('fd')||n.startsWith('fe8')||n.startsWith('fe9')||n.startsWith('fea')||n.startsWith('feb')||n.startsWith('ff'); }
function isUnsafeAddress(ip: string): boolean { const v=isIP(ip); return v===4?isPrivateIPv4(ip):v===6?isPrivateIPv6(ip):true; }
export async function validateCustomProviderBaseUrl(baseUrl: string): Promise<string> {
 if(typeof baseUrl!=='string'||!baseUrl.trim()) throw new AIError('آدرس Base URL پرووایدر سفارشی الزامی است.','PROVIDER_CONFIG_ERROR');
 let url: URL; try { url=new URL(baseUrl.trim()); } catch { throw new AIError('Base URL پرووایدر سفارشی معتبر نیست.','PROVIDER_CONFIG_ERROR'); }
 if(url.protocol!=='https:') throw new AIError('برای Custom Provider فقط HTTPS مجاز است.','PROVIDER_CONFIG_ERROR');
 if(url.username||url.password) throw new AIError('قرار دادن نام کاربری یا رمز عبور داخل Base URL مجاز نیست.','PROVIDER_CONFIG_ERROR');
 if(url.port&&url.port!=='443') throw new AIError('پورت Custom Provider باید 443 باشد.','PROVIDER_CONFIG_ERROR');
 const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if(!host||host==='localhost'||host.endsWith('.localhost')||host==='metadata.google.internal') throw new AIError('مقصد داخلی یا غیرعمومی برای Custom Provider مجاز نیست.','PROVIDER_CONFIG_ERROR');
 if(isIP(host)&&isUnsafeAddress(host)) throw new AIError('آدرس IP خصوصی، لوپ‌بک یا لینک‌لوکال برای Custom Provider مجاز نیست.','PROVIDER_CONFIG_ERROR');
 if(!isIP(host)){ let addresses; try { addresses=await lookup(host,{all:true,verbatim:true}); } catch { throw new AIError('امکان اعتبارسنجی مقصد Custom Provider وجود ندارد.','PROVIDER_CONFIG_ERROR'); } if(!addresses.length||addresses.some(a=>isUnsafeAddress(a.address))) throw new AIError('مقصد Custom Provider به آدرس داخلی یا غیرعمومی resolve می‌شود.','PROVIDER_CONFIG_ERROR'); }
 return url.toString().replace(/\/+$/,'');
}