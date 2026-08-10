import { MasterDataPage } from '../shared/MasterDataPage';

/** 클린차량 기준정보. 구조는 배송용과 같고 대상만 다르다 (§10). */
export function CleaningMasterDataPage() {
  return <MasterDataPage purpose="CLEANING" />;
}
