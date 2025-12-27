from azure.storage.blob import BlobServiceClient
import os
from spire.xls import *
from spire.xls.common import *
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CONTAINER_NAME = "rag-poc-q2-container"
STORAGE_ACCOUNT_KEY = "s2o2JlrqYlSByT+K0pHUQSE8JnwRo+tvIlRSkfas0yHzhhXjat/5ZZyEi8knQ3CvPhjIj49aTF5E+AStEi29EA=="
CONNECT_STR = "DefaultEndpointsProtocol=https;AccountName=tmcgenaistrage;AccountKey=s2o2JlrqYlSByT+K0pHUQSE8JnwRo+tvIlRSkfas0yHzhhXjat/5ZZyEi8knQ3CvPhjIj49aTF5E+AStEi29EA==;EndpointSuffix=core.windows.net"
SAS_TOKEN = "sp=rw&st=2024-08-09T07:49:08Z&se=2024-08-09T15:49:08Z&spr=https&sv=2022-11-02&sr=c&sig=EOLjFyIXmENFrU5wST0osj%2FvDc7W8GiZZ3sZAZBC8qA%3D"


def upload_blob(data, blob_name):
    blob_service_client = BlobServiceClient.from_connection_string(
        CONNECT_STR, credential=SAS_TOKEN
    )
    blob_client = blob_service_client.get_blob_client(
        container=CONTAINER_NAME, blob=data
    )

    with open(data, "rb") as data:
        blob_client.upload_blob(data, overwrite=True)
        logger.info(f"Uploaded {data} to {blob_name}")


def convert_to_pdf(data_path, output_dir):
    try:
        workbook = Workbook()
        workbook.LoadFromFile(data_path)
        file_name_with_extension = os.path.basename(data_path)
        pdf_file_name = os.path.splitext(file_name_with_extension)[0]

        pdf_path = os.path.join(output_dir, f"{pdf_file_name}.pdf")
        os.makedirs(os.path.dirname(pdf_path), exist_ok=True)

        logger.info(f"pdf filepath={pdf_path} output_dir={output_dir}")
        workbook.SaveToFile(pdf_path, FileFormat.PDF)
        workbook.Dispose()

        upload_blob(pdf_path, output_dir)
    except Exception as e:
        # logger.error(f"Error converting {data_path} to pdf: {e}", exc_info=True)
        logger.error(f"Error converting {data_path} to pdf: {e}")
        # raise e


def main():

    blob_service_client = BlobServiceClient.from_connection_string(CONNECT_STR)
    container_client = blob_service_client.get_container_client(CONTAINER_NAME)

    tmp_path = "./tmp/"
    os.makedirs(tmp_path, exist_ok=True)

    for blob in container_client.list_blobs():
        blob_client = container_client.get_blob_client(blob)
        data_path = os.path.join(tmp_path, blob.name)
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        ngfilelist = [
            "NSM003_発生シーンマップ.xlsx",
            "NSM007_OFF臭、凍結臭の頻度低減.pdf",
        ]
        if data_path.find("NSM003_発生シーンマップ.xlsx") > 0:
            continue

        with open(data_path, "wb+") as file:
            file.write(blob_client.download_blob().readall())

        convert_to_pdf(data_path, "./pdf/" + os.path.dirname(blob.name))


if __name__ == "__main__":
    main()
