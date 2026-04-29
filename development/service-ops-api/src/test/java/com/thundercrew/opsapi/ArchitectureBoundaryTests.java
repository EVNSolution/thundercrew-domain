package com.thundercrew.opsapi;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;

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

    @ArchTest
    static final ArchRule issue_12_must_not_add_rest_controllers = noClasses()
            .should().beAnnotatedWith(RestController.class)
            .orShould().beAnnotatedWith(Controller.class);

    @ArchTest
    static final ArchRule issue_12_persistence_baseline_must_not_use_jpa_relationship_annotations = noFields()
            .should().beAnnotatedWith(ManyToOne.class)
            .orShould().beAnnotatedWith(OneToMany.class)
            .orShould().beAnnotatedWith(OneToOne.class)
            .orShould().beAnnotatedWith(ManyToMany.class);
}
