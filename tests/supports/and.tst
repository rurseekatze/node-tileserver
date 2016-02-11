@supports ( user-agent: node-tileserver ) and
          ( user-agent: other ) {
	way {
		z-index: 2;
	}
}
@supports ( user-agent: node-tileserver ) AND
          ( user-agent: node-tileserver ) {
	node {
		z-index: 1;
	}
}
