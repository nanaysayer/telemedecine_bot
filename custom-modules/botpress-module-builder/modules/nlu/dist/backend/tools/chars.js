"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SPECIAL_CHARSET = exports.LATIN_CHARSET = void 0;
const LATIN_CHARSET = `
0123456789
-
abcdefghijklmnopqrstuvwxyz
ÄäÀàÁáÂâÃãÅåǍǎĄąĂăÆæĀā
ÇçĆćĈĉČč
ĎđĐďð
ÈèÉéÊêËëĚěĘęĖėĒē
ĜĝĢģĞğ
Ĥĥ
ÌìÍíÎîÏïıĪīĮį
Ĵĵ
Ķķ
ĹĺĻļŁłĽľ
ÑñŃńŇňŅņ
ÖöÒòÓóÔôÕõŐőØøŒœ
ŔŕŘř
ẞßŚśŜŝŞşŠšȘș
ŤťŢţÞþȚț
ÜüÙùÚúÛûŰűŨũŲųŮůŪū
Ŵŵ
ÝýŸÿŶŷ
ŹźŽžŻż`.replace(/\n/g, '').split('');
exports.LATIN_CHARSET = LATIN_CHARSET;
const SPECIAL_CHARSET = '¿÷≥≤µ˜∫√≈æ…¬˚˙©+-_!@#$%?&*()/\\[]{}:;<>=.,~`"\''.split('').map(c => `\\${c}`);
exports.SPECIAL_CHARSET = SPECIAL_CHARSET;
//# sourceMappingURL=chars.js.map