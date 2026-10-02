# Adds the TesseraWidget extension target (ios/TesseraWidget) and the
# widget bridge (TesseraWidgetBridge.m, TesseraWidgetReloader.swift) to the
# app. Safe to run twice: it does nothing if the target already exists.
require 'xcodeproj'

project_path = File.join(__dir__, 'GravityInit.xcodeproj')
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |t| t.name == 'GravityInit' } or raise 'GravityInit target not found'

if project.targets.any? { |t| t.name == 'TesseraWidget' }
  puts 'TesseraWidget already present'
  exit 0
end

# The bridge, in the app target.
app_group = project.main_group.find_subpath('GravityInit', false) or raise 'GravityInit group not found'
%w[TesseraWidgetBridge.m TesseraWidgetReloader.swift].each do |name|
  # This group has no folder of its own: its files carry the folder in
  # their path, like the rest of the app's sources.
  ref = app_group.files.find { |f| f.path == "GravityInit/#{name}" } || app_group.new_reference("GravityInit/#{name}")
  ref.name = name
  app.source_build_phase.add_file_reference(ref, true)
end

# The extension.
app_settings = app.build_configurations.first.build_settings
ext = project.new_target(:app_extension, 'TesseraWidget', :ios, '15.1', nil, :swift)
group = project.main_group.find_subpath('TesseraWidget', true)
group.set_source_tree('<group>')
group.set_path('TesseraWidget')
ext.add_file_references([group.new_reference('TesseraWidget.swift')])
ext.resources_build_phase.add_file_reference(group.new_reference('daily-schedule.json'), true)
group.new_reference('Info.plist')

ext.build_configurations.each do |config|
  s = config.build_settings
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.marisdenis.tessera.widget'
  s['INFOPLIST_FILE'] = 'TesseraWidget/Info.plist'
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SWIFT_VERSION'] = '5.0'
  s['DEVELOPMENT_TEAM'] = app_settings['DEVELOPMENT_TEAM']
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
  s['MARKETING_VERSION'] = app_settings['MARKETING_VERSION'] || '1.0'
  s['CURRENT_PROJECT_VERSION'] = app_settings['CURRENT_PROJECT_VERSION'] || '1'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  s['SKIP_INSTALL'] = 'YES'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
end
ext.add_system_frameworks(%w[WidgetKit SwiftUI])

# Built with the app, and embedded in it.
app.add_dependency(ext)
embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' } || app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.dst_subfolder_spec = '13'
build_file = embed.add_file_reference(ext.product_reference, true)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

project.save
puts 'Added TesseraWidget target and widget bridge'
