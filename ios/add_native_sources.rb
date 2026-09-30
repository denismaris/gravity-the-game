#!/usr/bin/env ruby
# Adds the app's own native source files (under GravityInit/) to the
# GravityInit target's Compile Sources phase. Idempotent - safe to re-run.
# Usage (from ios/): ruby add_native_sources.rb TesseraReminders.m
require 'xcodeproj'

project = Xcodeproj::Project.open('GravityInit.xcodeproj')
target = project.targets.find { |t| t.name == 'GravityInit' }
raise "Target 'GravityInit' not found" unless target
group = project.main_group['GravityInit']
raise "Group 'GravityInit' not found" unless group

ARGV.each do |name|
  path = "GravityInit/#{name}"
  raise "#{path} does not exist" unless File.exist?(path)
  # The GravityInit group has a name but no path of its own, so a file in
  # it is referenced by its path from ios/ (as the Sounds are).
  ref = group.files.find { |f| f.path == name || f.path == path } || group.new_reference(path)
  ref.path = path
  ref.name = name
  if target.source_build_phase.files_references.include?(ref)
    puts "already compiled: #{name}"
  else
    target.source_build_phase.add_file_reference(ref)
    puts "added: #{name}"
  end
end
project.save
