.PHONY: wasm dev clean

# Define variables for the WASM build target and output directory.
WASM_TARGET := bundler
WASM_OUT_DIR := web/pkg

# The 'wasm' target compiles the WASM module.
wasm:
	@echo "Compiling WASM module with wasm-pack..."
	wasm-pack build --target $(WASM_TARGET) --out-dir $(WASM_OUT_DIR)

# The 'dev' target builds the WASM module and then starts the webpack dev server.
dev: wasm
	@echo "Starting webpack dev server..."
	cd web && npm start

# The 'clean' target removes the build artifacts.
clean:
	@echo "Cleaning up..."
	cargo clean
	rm -rf $(WASM_OUT_DIR)
