LuNA launch pipeline
====================

The file `launch_pipeline.luna` is a pipeline in the LuNA language that contains all possible paths for launching a program.

To add new code fragments to the pipeline as one of the solutions, you must:

1. Create a description of your code fragment in a subdirectory with the name of your code fragment.
   1. This directory should contain `manifest.json` with [code fragment description](https://gitlab.ssd.sscc.ru/luna/std/-/blob/1d94ad9011e04da4c4832b670f848b7051105c78/code_fragment.md).
   For example, if your code fragment has type `CLIF`, you can see the file structure [here](https://gitlab.ssd.sscc.ru/luna/std/-/blob/1d94ad9011e04da4c4832b670f848b7051105c78/clif.md#clif--command-line-interface-format).
   2. If your component is in a format other than one described in the valid formats, you need to create a wrapper in a valid format, such as `CLIF` format. The wrapper program can be placed in the same directory of the code fragment.
   3. The `executable` field in `manifest.json` must contain the path relative to the same `manifest.json` to the executable file that is your component, or is a wrapper that runs your component. According to this, the executable must be able to be run from the command line, for example by adding a shebang.
2. In the `launch_pipeline.luna` file, import your code fragment following the example imported earlier.
3. In the `build_luna` function in the `launch_pipeline.luna` file, add a call to your code fragment with the required input and output arguments. The order is not important; the scheduler itself will choose the generation path and sequence of operations based on the arguments passed.
4. Add new code fragments or new code fragments calls as needed.

All subdirectories are code snippets, most or all of them in `CLIF` format. When creating your code snippet, use them as a reference.