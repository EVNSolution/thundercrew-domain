package com.thundercrew.opsapi;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

@AnalyzeClasses(packages = "com.thundercrew.opsapi", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureBoundaryTests {

    @ArchTest
    static final ArchRule common_must_not_depend_on_bounded_contexts = classes()
            .that().resideInAPackage("..common..")
            .should().onlyDependOnClassesThat().resideOutsideOfPackages(
                    "..auth..",
                    "..rider..",
                    "..bike..",
                    "..contract..",
                    "..insurance..",
                    "..equipment..",
                    "..device..",
                    "..telemetry..",
                    "..station..",
                    "..dashboard..");
}
