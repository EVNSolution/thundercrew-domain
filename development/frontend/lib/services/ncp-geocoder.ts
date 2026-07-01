/**
 * NCP Maps Geocoding (server-side). 운영자가 다음 우편번호로 고른 주소를
 * 위경도로 변환해서 BSS 등록 시 (0, 0) placeholder 대신 실제 좌표를 박을 수
 * 있게 한다. 다음/카카오 우편번호 팝업은 좌표를 안 돌려주므로 이 보완이
 * 필요하다.
 *
 * 인증: 같은 NCP Maps Application 의 Client ID + Client Secret 쌍을 그대로
 * `x-ncp-apigw-api-key-id` / `x-ncp-apigw-api-key` 헤더에 박는다. 따로
 * API Gateway 서비스 어카운트를 발급할 필요 없이 클라이언트 SDK 와 같은
 * 인증서를 재사용 — Client ID 는 어차피 NEXT_PUBLIC_ 으로 브라우저에 노출
 * 되고, 진짜 보안은 Client Secret 의 비밀성 + NCP 콘솔의 origin
 * allowlist 가 담당한다. Client Secret 만 NEXT_PUBLIC_ 접두사 없이 서버에
 * 머무르게 한다.
 *
 * 실패 시 정책: 호출 측이 graceful degradation 을 결정한다 — 본 모듈은 null
 * 을 돌려주고, 호출 측이 (0, 0) placeholder 로 폴백할지 등록을 거부할지
 * 정한다. 운영자에게 등록이 통째로 실패하는 것보다는 일단 row 가 들어가고
 * 좌표를 나중에 손볼 수 있는 쪽이 덜 답답하다.
 */
export interface GeocodedCoordinates {
  latitude: number;
  longitude: number;
}

const NCP_GEOCODE_ENDPOINT = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";

interface NcpGeocodeAddress {
  /** 경도 (longitude). 문자열로 내려온다. */
  x: string;
  /** 위도 (latitude). 문자열로 내려온다. */
  y: string;
}

interface NcpGeocodeResponse {
  status: string;
  addresses?: NcpGeocodeAddress[];
}

export async function geocodeAddress(address: string): Promise<GeocodedCoordinates | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const clientId = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
  const clientSecret = process.env.NCP_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    // env 미설정 시 호출 자체를 안 한다. 호출 측이 null 을 받아 polyfill
    // 로 갈 수 있게 — 콘솔 노이즈도 안 만들고, env 가 빠진 dev/sandbox
    // 에서 BSS 등록이 막히지 않도록.
    return null;
  }

  const url = `${NCP_GEOCODE_ENDPOINT}?query=${encodeURIComponent(trimmed)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "x-ncp-apigw-api-key-id": clientId,
        "x-ncp-apigw-api-key": clientSecret,
        Accept: "application/json"
      },
      // 운영자 폼 submit 한 번에 한 번만 호출하니까 캐시는 의미 없고,
      // Next.js fetch 가 기본적으로 캐시를 시도하는 것 자체가 불필요한
      // 노이즈라 명시적으로 비활성화한다.
      cache: "no-store"
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: NcpGeocodeResponse;
  try {
    body = (await response.json()) as NcpGeocodeResponse;
  } catch {
    return null;
  }

  if (body.status !== "OK" || !body.addresses || body.addresses.length === 0) {
    return null;
  }

  const first = body.addresses[0];
  const longitude = Number.parseFloat(first.x);
  const latitude = Number.parseFloat(first.y);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  return { latitude, longitude };
}
