import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { createAuthService, type RiderRuntimeConfig } from '../../app/config/riderRuntimeConfig'
import { loginAndPersist } from '../../domain/session/riderSession'
import type { RiderAuthTokenStore } from '../../domain/riderAuth/riderAuthTokenStore'

export type LoginScreenProps = {
  config: RiderRuntimeConfig
  store: RiderAuthTokenStore
  onLoggedIn: (accessToken: string) => void
}

export function LoginScreen({ config, store, onLoggedIn }: LoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    const auth = createAuthService(config)
    if (auth === null) {
      setError('서버 설정이 없습니다.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await loginAndPersist({ auth, store }, { phoneNumber, password })
      if (result.kind === 'success') {
        onLoggedIn(result.tokens.accessToken)
        return
      }
      if (result.kind === 'invalid_credentials') {
        setError('전화번호 또는 비밀번호가 올바르지 않습니다.')
        return
      }
      setError(result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>썬더크루 라이더</Text>
      <TextInput
        style={styles.input}
        placeholder="전화번호 (예: +821012345678)"
        keyboardType="phone-pad"
        autoCapitalize="none"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '로그인 중…' : '로그인'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: '#dc2626',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0a58ca',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
})
