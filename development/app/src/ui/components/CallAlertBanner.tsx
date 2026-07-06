import { useEffect } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

export type CallAlertBannerProps = {
  /** Alert text; null hides the banner. */
  message: string | null
  /** Tapped — e.g. jump to the 대기 콜 tab. */
  onPress: () => void
  /** Auto-dismiss or tap dismiss. */
  onDismiss: () => void
  /** Auto-dismiss delay in ms. */
  autoDismissMs?: number
}

/**
 * A top in-app banner for new offered-call alerts. Absolutely positioned over
 * the screen, auto-dismisses after a few seconds, and dismisses on tap.
 */
export function CallAlertBanner({ message, onPress, onDismiss, autoDismissMs = 5000 }: CallAlertBannerProps) {
  useEffect(() => {
    if (message === null) {
      return
    }
    const timer = setTimeout(onDismiss, autoDismissMs)
    return () => clearTimeout(timer)
    // message identity drives a fresh timer for each new alert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, autoDismissMs])

  if (message === null) {
    return null
  }

  return (
    <Pressable
      style={styles.banner}
      onPress={() => {
        onPress()
        onDismiss()
      }}
    >
      <Text style={styles.title}>🔔 새 대기 콜</Text>
      <Text style={styles.body} numberOfLines={2}>
        {message}
      </Text>
      <Text style={styles.hint}>탭하여 대기 콜 보기</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 1000,
    elevation: 8,
    backgroundColor: '#0a58ca',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  body: {
    color: '#e2e8f0',
    marginTop: 2,
  },
  hint: {
    color: '#bfdbfe',
    fontSize: 12,
    marginTop: 4,
  },
})
