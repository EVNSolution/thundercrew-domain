import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { computeMeCenteredRegion } from './meCenteredRegion'

const me = { latitude: 37.5, longitude: 127.0 }

describe('computeMeCenteredRegion', () => {
  it('centers the region exactly on the rider', () => {
    const region = computeMeCenteredRegion(me, [{ latitude: 37.6, longitude: 127.2 }])
    const centerLat = region.latitude + region.latitudeDelta / 2
    const centerLng = region.longitude + region.longitudeDelta / 2
    assert.ok(Math.abs(centerLat - me.latitude) < 1e-9)
    assert.ok(Math.abs(centerLng - me.longitude) < 1e-9)
  })

  it('contains every order inside the region bounds', () => {
    const orders = [
      { latitude: 37.7, longitude: 127.3 },
      { latitude: 37.2, longitude: 126.6 },
    ]
    const region = computeMeCenteredRegion(me, orders)
    const south = region.latitude
    const north = region.latitude + region.latitudeDelta
    const west = region.longitude
    const east = region.longitude + region.longitudeDelta
    for (const order of orders) {
      assert.ok(order.latitude >= south && order.latitude <= north, 'lat within bounds')
      assert.ok(order.longitude >= west && order.longitude <= east, 'lng within bounds')
    }
  })

  it('applies the minimum half-span when there are no orders', () => {
    const region = computeMeCenteredRegion(me, [], { padding: 1, minHalfSpanDeg: 0.01 })
    assert.equal(region.latitudeDelta, 0.02)
    assert.equal(region.longitudeDelta, 0.02)
  })

  it('pads the span so the farthest order is not flush against the edge', () => {
    const region = computeMeCenteredRegion(me, [{ latitude: 37.6, longitude: 127.0 }], {
      padding: 1.3,
      minHalfSpanDeg: 0,
    })
    // farthest lat distance = 0.1, padded half = 0.13, full delta = 0.26
    assert.ok(Math.abs(region.latitudeDelta - 0.26) < 1e-9)
  })
})
