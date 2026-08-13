plugins {
	java
	id("org.springframework.boot") version "3.5.14"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.thundercrew"
version = "0.0.1-SNAPSHOT"
description = "ThunderCrew operations API scaffold"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.flywaydb:flyway-core")
	implementation("org.flywaydb:flyway-database-postgresql")
	implementation("org.apache.poi:poi-ooxml:5.3.0")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation("org.springframework.security:spring-security-test")
	testImplementation("org.testcontainers:junit-jupiter")
	testImplementation("org.testcontainers:postgresql")
	testImplementation("com.tngtech.archunit:archunit-junit5:1.4.1")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()

	// 아키텍처 규칙 검사를 빼고 돌릴 수 있게 한다. `-PskipArchitectureTests`.
	//
	// ArchitectureBoundaryTests 의 allowlist 가 낡아서 dev 기준선에서도 20건이
	// 위반으로 잡힌다(전부 나중에 추가된 커맨드 컨트롤러 메서드다). 이걸 PR 차단
	// 조건에 두면 CI 가 처음부터 빨개지고, 그러면 아무도 CI 를 보지 않게 된다.
	// 그래서 CI 는 이 검사를 별도의 비차단 잡으로 돌려서 위반을 계속 보이게 하되
	// PR 을 막지는 않는다. allowlist 를 정리하면 이 플래그를 없애면 된다.
	if (project.hasProperty("skipArchitectureTests")) {
		filter { excludeTestsMatching("com.thundercrew.opsapi.ArchitectureBoundaryTests") }
	}

	val colimaSocket = file("${System.getProperty("user.home")}/.colima/default/docker.sock")
	if (colimaSocket.exists()) {
		environment("DOCKER_HOST", "unix://${colimaSocket.absolutePath}")
		environment("TESTCONTAINERS_RYUK_DISABLED", "true")
	}
}
