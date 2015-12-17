node
{
	text: "name";
	foo: "name";
}

node["notext"]
{
	text: "";
	foo: "";
}

way
{
	text: eval(tag("name"));
	foo: eval(tag("name"));
	bar: eval(prop("foo"));
}

way["notext"]
{
	text: eval(tag(""));
	foo: eval(tag(""));
	bar: eval(prop(""));
}
