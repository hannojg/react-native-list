require 'xcodeproj'
require 'fileutils'
require 'json'

root = ARGV.fetch(0)
team = ARGV.fetch(1)
project_path = File.join(root, 'example/ios/ListPerf.xcodeproj')
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'ListPerf' }
abort 'Expected generated ListPerf app target' unless app
suffix = team.downcase
suffix = 'simulator' if suffix.empty?
app_identifier = "com.hannojg.list.perf.#{suffix}"

target = project.new_target(:ui_test_bundle, 'ListPerformanceTests', :ios, '26.0')
target.add_dependency(app)
source = File.join(root, 'perf/ios/ListPerformanceTests.swift')
reference = project.main_group.new_file(source)
target.source_build_phase.add_file_reference(reference)
target.build_configurations.each do |config|
  config.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => "#{app_identifier}.tests",
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'ENABLE_TESTING_SEARCH_PATHS' => 'YES',
    'TEST_TARGET_NAME' => 'ListPerf',
    'DEVELOPMENT_TEAM' => team,
    'CODE_SIGN_STYLE' => 'Automatic',
  })
end
app.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = app_identifier
  config.build_settings['DEVELOPMENT_TEAM'] = team
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.test_action.build_configuration = 'Release'
scheme.test_action.code_coverage_enabled = false
scheme.test_action.xml_element.attributes['selectedDebuggerIdentifier'] = ''
scheme.test_action.xml_element.attributes['selectedLauncherIdentifier'] = 'Xcode.IDEFoundation.Launcher.PosixSpawn'
scheme.test_action.disable_main_thread_checker = true

plan = {
  'version' => 1,
  'configurations' => [{ 'id' => '8FDC1837-6A60-45F1-8C8A-4C2A8580CE12', 'name' => 'Performance', 'options' => {} }],
  'defaultOptions' => {
    'codeCoverage' => false,
    'mainThreadCheckerEnabled' => false,
    'threadPerformanceCheckerEnabled' => false,
    'performanceAntipatternCheckerEnabled' => false,
    'addressSanitizerEnabled' => false,
    'threadSanitizerEnabled' => false,
    'undefinedBehaviorSanitizerEnabled' => false,
    'testTimeoutsEnabled' => true,
    'defaultTestExecutionTimeAllowance' => 600,
    'maximumTestExecutionTimeAllowance' => 600,
  },
  'testTargets' => [{
    'parallelizable' => false,
    'target' => { 'containerPath' => 'container:ListPerf.xcodeproj', 'identifier' => target.uuid, 'name' => target.name },
  }],
}
plan_path = File.join(root, 'example/ios/ListPerformance.xctestplan')
File.write(plan_path, JSON.pretty_generate(plan))
testables = scheme.test_action.xml_element.elements['Testables']
scheme.test_action.xml_element.delete_element(testables)
plans = scheme.test_action.xml_element.add_element('TestPlans')
plans.add_element('TestPlanReference', { 'reference' => 'container:ListPerformance.xctestplan', 'default' => 'YES' })
scheme.save_as(project.path, 'ListPerformance', true)
