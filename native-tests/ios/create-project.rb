require 'xcodeproj'

project_path = File.join(__dir__, 'NativeRuntimeTests.xcodeproj')
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:unit_test_bundle, 'NativeRuntimeTests', :ios, '16.4')
file = project.main_group.new_file('NativeRuntimeTests.mm')
target.source_build_phase.add_file_reference(file)
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.hannojg.list.runtime-tests'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'NativeRuntimeTests', true)
