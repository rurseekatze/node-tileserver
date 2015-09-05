project(NodeTileserver NONE)

cmake_minimum_required(VERSION 2.8.7 FATAL_ERROR)

find_package(PythonInterp REQUIRED)

set(_converter_command ${PYTHON_EXECUTABLE} -d ${CMAKE_CURRENT_SOURCE_DIR}/../mapcss_converter.py)

enable_testing()

add_test(NAME show_usage COMMAND ${_converter_command} --help)
set_tests_properties(show_usage PROPERTIES PASS_REGULAR_EXPRESSION "-s SPRITE, --output-sprite=SPRITE")
