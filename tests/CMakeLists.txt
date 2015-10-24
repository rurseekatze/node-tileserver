project(NodeTileserver NONE)

cmake_minimum_required(VERSION 2.8.7 FATAL_ERROR)

find_package(PythonInterp REQUIRED)

set(_converter_command ${PYTHON_EXECUTABLE} -d ${CMAKE_CURRENT_SOURCE_DIR}/../mapcss_converter.py)

enable_testing()

file(GLOB_RECURSE TEST_FILES LIST_DIRECTORIES false RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" "*.tst")
list(SORT TEST_FILES)

foreach (_file IN LISTS TEST_FILES)
	get_filename_component(_path "${_file}" PATH)
	get_filename_component(_name "${_file}" NAME_WE)
	string(REPLACE "/" "_" _testname "${_path}_${_name}")
	add_test(NAME "${_testname}" COMMAND ${_converter_command} -o - -i "${CMAKE_CURRENT_SOURCE_DIR}/${_file}")
	if (EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${_path}/${_name}.fail_re")
		file(READ "${CMAKE_CURRENT_SOURCE_DIR}/${_path}/${_name}.fail_re" _fail_re)
		set_tests_properties(${_testname} PROPERTIES FAIL_REGULAR_EXPRESSION "${_fail_re}")
	endif ()
	if (EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${_path}/${_name}.pass_re")
		file(READ "${CMAKE_CURRENT_SOURCE_DIR}/${_path}/${_name}.pass_re" _pass_re)
		set_tests_properties(${_testname} PROPERTIES PASS_REGULAR_EXPRESSION "${_pass_re}")
	endif ()
	if (EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${_path}/${_name}.fail_re")
		file(READ "${CMAKE_CURRENT_SOURCE_DIR}/${_path}/${_name}.fail_re" _fail_re)
		set_tests_properties(${_testname} PROPERTIES FAIL_REGULAR_EXPRESSION "${_fail_re}")
	else ()
		set_tests_properties(${_testname} PROPERTIES FAIL_REGULAR_EXPRESSION "Illegal character;Syntax error")
	endif ()
endforeach ()

add_test(NAME show_usage COMMAND ${_converter_command} --help)
set_tests_properties(show_usage PROPERTIES PASS_REGULAR_EXPRESSION "-s SPRITE, --output-sprite=SPRITE")

file(GLOB_RECURSE TEST_FILES LIST_DIRECTORIES false RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" "known_bugs/parse/*.ill")
list(SORT TEST_FILES)

foreach(_file IN LISTS TEST_FILES)
	get_filename_component(_name "${_file}" NAME_WE)
	add_test(NAME "bug_${_name}" COMMAND ${_converter_command} -o - -i "${CMAKE_CURRENT_SOURCE_DIR}/${_file}")
	set_tests_properties(bug_${_name} PROPERTIES PASS_REGULAR_EXPRESSION "Illegal character '.' at line")
endforeach ()

configure_file("${CMAKE_CURRENT_SOURCE_DIR}/import.css" "${CMAKE_CURRENT_BINARY_DIR}/import.css" COPYONLY)
