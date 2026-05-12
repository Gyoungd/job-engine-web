const { google } = require('googleapis');
const readline = require('readline');

// 직접 입력 (gmail-credentials.json에서 복사)
var CLIENT_ID = '806336906152-jjddo8te1i6ojiegmaaqu8op1mn4i043.apps.googleusercontent.com';
var CLIENT_SECRET = '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';

var oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost');

var SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive'
];

var authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Grant access, copy the code from redirect URL');
console.log('   (everything after "code=" and before "&scope=")\n');

var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('3. Paste code here: ', async function(code) {
  try {
    var res = await oauth2.getToken(decodeURIComponent(code));
    var t = res.tokens;
    console.log('\n✅ Success!\n');
    console.log('GMAIL_TOKEN_JSON=' + JSON.stringify({
      token: t.access_token,
      refresh_token: t.refresh_token,
      token_uri: 'https://oauth2.googleapis.com/token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scopes: SCOPES,
      expiry: t.expiry_date ? new Date(t.expiry_date).toISOString() : null
    }));
    console.log('\n↑ Copy this entire line to .env.local');
  } catch(e) {
    console.error('Error:', e.message);
  }
  rl.close();
});