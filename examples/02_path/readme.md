This test implements the following:

import "fs://./inc" as inc;
import "fs://./inc2" as inc2;
import "fs://./add" as add;

sub main() {
	name x, y, z;

	add(x, 1, y);
	inc(y, z);
	inc2(x, z);
}

task "cpf" t {
	int => x,
	int <= z 
} on main;

rename ./inc2 to something else to force plan "B"
