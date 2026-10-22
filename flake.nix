{
  description = "Stadt-Land-Fluss Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in {
        packages.default =
          let
            nodeModules = pkgs.stdenvNoCC.mkDerivation {
              name = "slf-node-modules-${builtins.substring 0 8 (builtins.hashFile "sha256" ./frontend/bun.lock)}";
              src = ./frontend;
              nativeBuildInputs = [ pkgs.bun ];
              buildPhase = "HOME=$TMPDIR bun install --frozen-lockfile --ignore-scripts --no-progress";
              installPhase = "mkdir $out && cp -r node_modules $out";
              dontFixup = true;
              outputHashMode = "recursive";
              outputHash = "sha256-9dH5CNSpPUcp8P36X5sBDh+oB7XFTU53KEyez8zUwTA=";
            };
            frontend = pkgs.stdenvNoCC.mkDerivation {
              name = "slf-frontend";
              src = ./frontend;
              nativeBuildInputs = [ pkgs.bun pkgs.nodejs pkgs.brotli pkgs.autoPatchelfHook ];
              buildInputs = [ pkgs.stdenv.cc.cc.lib pkgs.glibc ];
              buildPhase = ''
                cp -r ${nodeModules}/node_modules .
                chmod -R u+w node_modules
                patchShebangs node_modules
                autoPatchelf node_modules/@biomejs
                bun run lint
                bun test src
                bun run build
                find dist -type f -regex '.*\.\(html\|js\|css\|svg\|txt\)' \
                  -exec gzip -9kn {} \; -exec brotli -Z {} \;
              '';
              installPhase = "cp -r dist $out";
            };
          in
          pkgs.buildGoModule {
            pname = "slf";
            version = (builtins.fromJSON (builtins.readFile ./frontend/package.json)).version;
            src = ./backend;
            vendorHash = "sha256-1ckWAhiyEgGgIk/9Y/bgj4msc4eNVpsRgyIpxK8hDks=";
            preCheck = ''
              test -z "$(gofmt -l cmd internal)" || { gofmt -l cmd internal; exit 1; }
              go vet ./...
            '';
            postInstall = ''
              mv $out/bin/server $out/bin/slf
              mkdir $out/share
              ln -s ${frontend} $out/share/slf
            '';
          };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Go
            go
            gopls
            air

            # Frontend
            bun
            nodejs_22

            # Git
            git

            # Compiler / Build Tools
            gcc
            gnumake

            # Utilities
            jq
            curl
            wget
            tree
            less
            scc
          ];

          shellHook = ''
            echo ""
            echo "======================================="
            echo " Stadt-Land-Fluss Dev Environment"
            echo "======================================="
            echo ""
            echo "Go:      $(go version)"
            echo "Bun:     $(bun --version)"
            echo "Node:    $(node --version)"
            echo ""
          '';
        };
      });
}
