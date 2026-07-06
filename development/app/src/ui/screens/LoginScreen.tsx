import { useEffect, useState } from 'react'
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native'

import { createAuthService, type RiderRuntimeConfig } from '../../app/config/riderRuntimeConfig'
import { loginAndPersist } from '../../domain/session/riderSession'
import { normalizeDriverPhoneEntry } from '../../domain/phone/phoneEntry'
import type { RiderAuthTokenStore } from '../../domain/riderAuth/riderAuthTokenStore'
import { CountryPhoneInput } from '../components/CountryPhoneInput'

export type LoginScreenProps = {
  config: RiderRuntimeConfig
  store: RiderAuthTokenStore
  onLoggedIn: (accessToken: string) => void
}

const DEFAULT_COUNTRY_ISO2 = 'KR'
const CONTENT_PADDING = 24

export function LoginScreen({ config, store, onLoggedIn }: LoginScreenProps) {
  const [countryIso2, setCountryIso2] = useState(DEFAULT_COUNTRY_ISO2)
  const [nationalPhoneInput, setNationalPhoneInput] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 이 앱은 edge-to-edge 라 키보드가 떠도 안드로이드 창이 리사이즈되지 않고 콘텐츠 위를 덮는다.
  // 키보드 높이만큼 콘텐츠 하단 패딩을 늘리면 justifyContent:center 가 폼을 키보드 위 가시영역
  // 안에서 다시 중앙정렬하므로, 어떤 입력 필드도 키보드에 가려지지 않는다.
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height)
    })
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0)
    })
    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  async function submit() {
    const auth = createAuthService(config)
    if (auth === null) {
      setError('서버 설정이 없습니다.')
      return
    }

    const normalized = normalizeDriverPhoneEntry({ countryIso2, nationalPhoneInput })
    if (!normalized.ok) {
      setError('전화번호를 확인해주세요.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await loginAndPersist({ auth, store }, { phoneNumber: normalized.phoneE164, name })
      if (result.kind === 'success') {
        onLoggedIn(result.tokens.accessToken)
        return
      }
      if (result.kind === 'invalid_credentials') {
        setError('전화번호 또는 이름이 일치하지 않습니다.')
        return
      }
      setError(result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: CONTENT_PADDING + keyboardHeight }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>썬더크루 라이더</Text>
      <CountryPhoneInput
        countryIso2={countryIso2}
        nationalPhoneInput={nationalPhoneInput}
        onChangeCountryIso2={setCountryIso2}
        onChangeNationalPhoneInput={setNationalPhoneInput}
      />
      <TextInput
        style={styles.input}
        placeholder="이름"
        autoCapitalize="none"
        value={name}
        onChangeText={setName}
      />
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '로그인 중…' : '로그인'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 12,
    justifyContent: 'center',
    padding: CONTENT_PADDING,
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
