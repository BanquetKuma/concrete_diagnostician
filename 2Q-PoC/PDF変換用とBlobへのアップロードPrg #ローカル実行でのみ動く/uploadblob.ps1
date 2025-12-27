# powershell .\app\uploadblob.ps1  で実行
# 処理対象のフォルダ
# $str_copy_from = "C:\Users\yoichiro.abe\Downloads\各論_機密事項あり取り扱い注意\各論_機密事項あり取り扱い注意"
$str_copy_from = "C:\Users\yoichiro.abe\Downloads\リマインダ_機密事項あり取り扱い注意\リマインダ_機密事項あり取り扱い注意"
# SASトークン付きのURL
$url = 'https://tmcgenaistrage.blob.core.windows.net/rag-poc-q2-container'
# SASトークン ※先頭に？をつけること
$param = '?sp=racwdl&st=2024-08-14T07:48:56Z&se=2025-02-27T15:48:56Z&spr=https&sv=2022-11-02&sr=c&sig=u%2BgjTGUsvkHOytoF1NVNzrst1YNYe%2BuaJICAW5Ae628%3D'
function Upload-FilesRecursively {
    param (
        [string]$path
    )

    # 一時保存ディレクトリ内のファイル・フォルダのリストを取得する。
    $itemList = Get-ChildItem $path
    foreach ($item in $itemList) {
        Write-Host "処理中のアイテム: $($item.FullName)"

        if ($item.PSIsContainer) {
            # フォルダの場合の処理
            Write-Host "フォルダを処理中: $($item.FullName)"
            # 再帰的にフォルダ内のアイテムを処理
            Upload-FilesRecursively -path $item.FullName
        }
        else {
            # $itemの一番下のフォルダ名と、その親のフォルダ名を取得
            $folderName = $item.Directory.Name
            $parentFolderName = $item.Directory.Parent.Name
            $generateurl = ''
            $generateurl = $url + "/" + $parentFolderName + "/" + $folderName + "/" + $item.Name + $param
            # ファイルごとアップロード
            Write-Host "ファイルをアップロード: $($item.FullName)"
            .\azcopy copy $item.FullName $generateurl
        }
    }
}
# 処理開始
Upload-FilesRecursively -path $str_copy_from

