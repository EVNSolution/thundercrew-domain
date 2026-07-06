import { captureProofPhoto, type ProofPhotoCaptureService } from '../proof/proofPhotoCapture'
import type { RiderDispatchOrder, RiderDispatchService } from '../../api/thundercrew/riderDispatchClient'

export type CompleteOrderWithPhotoResult =
  | { kind: 'success'; order: RiderDispatchOrder }
  | { kind: 'cancelled' }
  | { kind: 'permission_denied'; message: string }
  | { kind: 'error'; message: string }

/**
 * Captures a proof-of-delivery photo via the camera and submits it to complete the order.
 *
 * `ProofPhotoCaptureResult.kind` is one of 'cancelled' | 'captured' | 'permission_denied'
 * (see src/domain/proof/proofPhotoCapture.ts) — the captured photo only exposes a `uri`
 * (no mime type), so we submit it as 'image/jpeg' to match the camera/library JPEG output.
 */
export async function completeOrderWithPhoto(input: {
  camera: ProofPhotoCaptureService
  dispatch: RiderDispatchService
  orderId: string
}): Promise<CompleteOrderWithPhotoResult> {
  const shot = await captureProofPhoto({ captureService: input.camera, source: 'camera' })

  if (shot.kind === 'cancelled') {
    return { kind: 'cancelled' }
  }

  if (shot.kind === 'permission_denied') {
    return { kind: 'permission_denied', message: shot.message }
  }

  try {
    const order = await input.dispatch.completeDelivery(input.orderId, {
      uri: shot.uri,
      name: 'proof.jpg',
      type: 'image/jpeg',
    })
    return { kind: 'success', order }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : 'Failed to complete delivery.' }
  }
}
