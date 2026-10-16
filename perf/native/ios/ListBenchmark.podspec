Pod::Spec.new do |s|
  s.name = 'ListBenchmark'
  s.version = '1.0.0'
  s.summary = 'Local UI List benchmark markers'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Hanno Gödecke'
  s.homepage = 'https://github.com/hannojg/react-native-list'
  s.source = { :git => s.homepage }
  s.platform = :ios, '26.0'
  s.swift_version = '5.0'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
end
