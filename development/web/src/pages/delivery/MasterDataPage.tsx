import { MasterDataPage } from '../shared/MasterDataPage';

/** 배송용 기준정보. 구조는 클린차량과 같고 대상만 다르다 (§10). */
export function DeliveryMasterDataPage() {
  return <MasterDataPage purpose="DELIVERY" />;
}
