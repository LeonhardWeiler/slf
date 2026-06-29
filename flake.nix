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

            # Docker
            docker
            docker-compose

            # Compiler / Build Tools
            gcc
            gnumake

            # Utilities
            jq
            curl
            wget
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
