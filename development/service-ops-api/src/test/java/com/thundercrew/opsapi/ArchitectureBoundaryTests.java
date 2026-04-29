package com.thundercrew.opsapi;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

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
    static final ArchRule issue_14_read_api_allows_get_only_route_methods = noMethods()
            .should().beAnnotatedWith(PostMapping.class)
            .orShould().beAnnotatedWith(PutMapping.class)
            .orShould().beAnnotatedWith(PatchMapping.class)
            .orShould().beAnnotatedWith(DeleteMapping.class);

    @ArchTest
    static final ArchRule issue_14_read_api_must_not_accept_request_bodies = methods()
            .that().areDeclaredInClassesThat().resideInAPackage("..controller..")
            .should(notHaveRequestBodyParameters());

    @ArchTest
    static final ArchRule issue_14_must_not_add_telemetry_or_dashboard_controllers = noClasses()
            .that().resideInAnyPackage("..telemetry..", "..dashboard..")
            .should().beAnnotatedWith(RestController.class);

    @ArchTest
    static final ArchRule persistence_baseline_must_not_use_jpa_relationship_annotations = noFields()
            .should().beAnnotatedWith(ManyToOne.class)
            .orShould().beAnnotatedWith(OneToMany.class)
            .orShould().beAnnotatedWith(OneToOne.class)
            .orShould().beAnnotatedWith(ManyToMany.class);

    private static ArchCondition<JavaMethod> notHaveRequestBodyParameters() {
        return new ArchCondition<>("not have @RequestBody parameters") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean hasRequestBodyParameter = method.getParameters().stream()
                        .anyMatch(parameter -> parameter.isAnnotatedWith(RequestBody.class));
                if (hasRequestBodyParameter) {
                    events.add(SimpleConditionEvent.violated(
                            method,
                            method.getFullName() + " must not declare @RequestBody parameters in the read-only API baseline"
                    ));
                }
            }
        };
    }

}
