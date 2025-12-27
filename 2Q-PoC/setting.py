import configparser

class IniFileReader:
    def __init__(self, file_path):
        self.config = configparser.ConfigParser()
        self.config.read(file_path)
    
    def get_value(self, section, key):
        """
        指定したセクションとキーに対応する値を取得する。
        """
        try:
            value = self.config[section][key]
        except KeyError:
            raise KeyError(f'Section "{section}" or key "{key}" not found in the configuration file.')
        return value
    
    def get_all_keys(self, section):
        """
        指定したセクション内のすべてのキーを取得する。
        """
        try:
            keys = self.config[section].keys()
        except KeyError:
            raise KeyError(f'Section "{section}" not found in the configuration file.')
        return keys

    def get_sections(self):
        """
        ファイル内のすべてのセクション名を取得する。
        """