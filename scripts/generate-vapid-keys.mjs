// 최초 1회만 실행: 웹 푸시용 VAPID 키 쌍을 생성합니다.
// 사용법: npm install 후 `npm run generate-vapid-keys`
//
// 결과로 나오는 publicKey는 앱 설정 화면(VAPID 공개키)에 입력하고,
// privateKey는 GitHub 저장소의 Actions Secret(VAPID_PRIVATE_KEY)으로 등록하세요.
// publicKey도 Secret(VAPID_PUBLIC_KEY)으로 함께 등록해두면 알림 발송 스크립트에서 사용합니다.
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('\n=== VAPID 키가 생성되었습니다 ===\n');
console.log('Public Key  (앱 설정 화면에 입력):');
console.log(keys.publicKey);
console.log('\nPrivate Key (GitHub Actions Secret: VAPID_PRIVATE_KEY):');
console.log(keys.privateKey);
console.log('\n다시 생성되지 않으니 안전한 곳에 보관하세요.\n');
