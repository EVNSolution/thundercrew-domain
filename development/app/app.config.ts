import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. app.json 의 정적 설정을 그대로 쓰되, 네이버 지도 config plugin 의
 * `client_id` 만 빌드 시점에 환경변수(EXPO_PUBLIC_NCP_MAP_CLIENT_ID)에서 주입한다.
 * 정적 app.json 은 env 를 읽을 수 없으므로(그리고 client ID 를 커밋하지 않기 위해) dynamic config 사용.
 * client_id 는 웹과 동일한 NCP Maps 애플리케이션의 Client ID(ncpKeyId) 다 — 콘솔에서
 * Mobile Dynamic Map 활성화 + 앱 패키지(com.evns.cleverdriverapp) 등록 후 사용.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Clever Driver',
  slug: config.slug ?? 'clever-driver-app',
  plugins: [
    ...(config.plugins ?? []),
    [
      '@mj-studio/react-native-naver-map',
      {
        client_id: process.env.EXPO_PUBLIC_NCP_MAP_CLIENT_ID ?? '',
      },
    ],
  ],
});
