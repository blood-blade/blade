# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }:
{
  # Which nixpkgs channel to use.
  channel = "stable-24.11";  # Using the newer channel version

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.zulu
  ];

  # Sets environment variables in the workspace
  env = {
    GMAIL_EMAIL = "invincibleshinmen@gmail.com";
    GMAIL_PASSWORD = "qzyl czow daei xabj";
  };

  # Firebase emulator configuration
  services.firebase.emulators = {
    detect = false;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };

  idx = {
    # Search for the extensions you want on https://open-vsx.org/
    extensions = [];

    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      onCreate = {
        default.openFiles = ["src/app/page.tsx"];
        npm-install = "npm install";
      };
    };
  };
}
