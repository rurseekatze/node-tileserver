// c0mment before selector
node // c0mment after selector
{
	z-index: 5; // c0mment after rule
	text: eval(cond(1 < 2, "/* this is no comment */", /* this is a c0mment */ "// this isn't either */"));
// c0mment
}
// c0mment at the end
