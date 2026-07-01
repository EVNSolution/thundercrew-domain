package com.thundercrew.opsapi.telemetry.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.thundercrew.opsapi.telemetry.domain.BikeCurrentState;
import com.thundercrew.opsapi.telemetry.domain.TelemetryIgnitionStatus;
import com.thundercrew.opsapi.telemetry.repository.BikeCurrentStateRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TelemetryIgnitionDerivationTests {

    private final BikeCurrentStateRepository currentStateRepository =
            mock(BikeCurrentStateRepository.class);

    // deriveIgnition은 9번째 생성자 인자(bikeCurrentStateRepository)만 사용하므로
    // 나머지 8개 의존성은 null로 두어도 무방하다.
    private TelemetryIngestionService newService() {
        return new TelemetryIngestionService(
                null, null, null, null, null, null, null, null, currentStateRepository);
    }

    @Test
    void accStatusZeroIsOff() {
        assertThat(newService().deriveIgnition(UUID.randomUUID(), 0))
                .isEqualTo(TelemetryIgnitionStatus.OFF);
    }

    @Test
    void accStatusNonZeroIsOn() {
        assertThat(newService().deriveIgnition(UUID.randomUUID(), 5))
                .isEqualTo(TelemetryIgnitionStatus.ON);
    }

    @Test
    void nullAccStatusCarriesForwardPreviousStatus() {
        UUID bikeId = UUID.randomUUID();
        BikeCurrentState previous = mock(BikeCurrentState.class);
        when(previous.getIgnitionStatus()).thenReturn(TelemetryIgnitionStatus.ON);
        when(currentStateRepository.findByBikeId(bikeId)).thenReturn(Optional.of(previous));

        assertThat(newService().deriveIgnition(bikeId, null))
                .isEqualTo(TelemetryIgnitionStatus.ON);
    }

    @Test
    void nullAccStatusCarriesForwardOffStatus() {
        UUID bikeId = UUID.randomUUID();
        BikeCurrentState previous = mock(BikeCurrentState.class);
        when(previous.getIgnitionStatus()).thenReturn(TelemetryIgnitionStatus.OFF);
        when(currentStateRepository.findByBikeId(bikeId)).thenReturn(Optional.of(previous));

        assertThat(newService().deriveIgnition(bikeId, null))
                .isEqualTo(TelemetryIgnitionStatus.OFF);
    }

    @Test
    void nullAccStatusCarriesForwardUnknownStatus() {
        UUID bikeId = UUID.randomUUID();
        BikeCurrentState previous = mock(BikeCurrentState.class);
        when(previous.getIgnitionStatus()).thenReturn(TelemetryIgnitionStatus.UNKNOWN);
        when(currentStateRepository.findByBikeId(bikeId)).thenReturn(Optional.of(previous));

        assertThat(newService().deriveIgnition(bikeId, null))
                .isEqualTo(TelemetryIgnitionStatus.UNKNOWN);
    }

    @Test
    void nullAccStatusWithNoPreviousIsUnknown() {
        UUID bikeId = UUID.randomUUID();
        when(currentStateRepository.findByBikeId(bikeId)).thenReturn(Optional.empty());

        assertThat(newService().deriveIgnition(bikeId, null))
                .isEqualTo(TelemetryIgnitionStatus.UNKNOWN);
    }

    @Test
    void nullAccStatusWithNullBikeIdIsUnknown() {
        assertThat(newService().deriveIgnition(null, null))
                .isEqualTo(TelemetryIgnitionStatus.UNKNOWN);
    }
}
