#!/usr/bin/env ruby
# Adds the staged react-native-sound WAV files to the Xcode project's
# resource bundle: a new "Sounds" group under the main GravityInit group,
# and a file reference for each WAV in the target's Resources build phase.
# Idempotent - safe to re-run (skips files already wired).
require 'xcodeproj'

project_path = 'GravityInit.xcodeproj'
sounds_dir = 'GravityInit/Sounds'

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'GravityInit' }
raise "Target 'GravityInit' not found" unless target

gravity_group = project.main_group['GravityInit']
raise "Group 'GravityInit' not found" unless gravity_group

sounds_group = gravity_group['Sounds'] || gravity_group.new_group('Sounds')

wav_files = Dir.glob("#{sounds_dir}/*.wav").sort
raise "No .wav files found under #{sounds_dir}" if wav_files.empty?

added = []
already_present = []

wav_files.each do |full_path|
  basename = File.basename(full_path)

  file_ref = sounds_group.files.find { |f| f.path == full_path }
  file_ref ||= sounds_group.new_reference(full_path)

  in_resources = target.resources_build_phase.files_references.include?(file_ref)
  if in_resources
    already_present << basename
  else
    target.resources_build_phase.add_file_reference(file_ref)
    added << basename
  end
end

project.save

puts "Added to Resources build phase: #{added.empty? ? '(none - already wired)' : added.join(', ')}"
puts "Already present: #{already_present.join(', ')}" unless already_present.empty?
