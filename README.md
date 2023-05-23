# extract-changelogs
GitHub Action to convert changelogs from monorepo with multiple files and packages to slack message format.
## Usage

### Inputs

* `changelog-files-config` - JSON string of key values pair of package name and respective changelog file path

### Outputs

* `released-package-versions` - JSON string of key values pair of package name and respective version