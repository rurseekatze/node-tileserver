way
{
	color: eval(cond(2 == 3, cond(2 == 4, "#0000ff", tag("foo")), cond(tag("bar") == "red", "#ff0000", tag("bar"))));
}
