const { google } = require('googleapis');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const saLine = env.split('\n').find(function(l) { return l.startsWith('GOOGLE_SERVICE_ACCOUNT_JSON='); });
const creds = JSON.parse(saLine.replace('GOOGLE_SERVICE_ACCOUNT_JSON=', ''));
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive'] });
const drive = google.drive({ version: 'v3', auth });

async function main() {
  // SA 스토리지 quota 확인
  var about = await drive.about.get({ fields: 'storageQuota' });
  var q = about.data.storageQuota;
  console.log('SA Storage:');
  console.log('  Limit:       ' + Math.round(q.limit / 1024 / 1024) + ' MB');
  console.log('  Usage:       ' + Math.round(q.usage / 1024 / 1024) + ' MB');
  console.log('  In Drive:    ' + Math.round(q.usageInDrive / 1024 / 1024) + ' MB');
  console.log('  In Trash:    ' + Math.round(q.usageInDriveTrash / 1024 / 1024) + ' MB');

  // SA 소유 파일 조회 (trashed 포함)
  var res = await drive.files.list({
    q: "'me' in owners",
    pageSize: 500,
    fields: 'files(id,name,size,trashed)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  var files = res.data.files || [];
  console.log('\nSA owns ' + files.length + ' files');
  for (var i = 0; i < files.length; i++) {
    console.log('  ' + files[i].name + ' | ' + Math.round((files[i].size||0)/1024) + 'KB | trashed=' + files[i].trashed);
  }
}
main();