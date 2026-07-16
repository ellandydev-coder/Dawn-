#include "core.h"
#include <string>
#include <cstring>

extern "C" int cpp_sumar(int a, int b) {
    return a + b;
}

extern "C" const char* cpp_saludar(const char* nombre) {
    std::string s = "Hola desde C++, " + std::string(nombre) + "!";
    char* out = new char[s.size() + 1];
    std::strcpy(out, s.c_str());
    return out;
}

extern "C" void cpp_free_string(const char* ptr) {
    delete[] ptr;
}