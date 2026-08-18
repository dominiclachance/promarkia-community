from typing import Dict, Any, List
import uuid
import pandas as pd  # For data analysis
from pathlib import Path
import matplotlib.pyplot as plt  # For chart generation
import seaborn as sns  # Enhanced visualization (optional)
import os

def analyze_csv_data(file_path: str, report_size: str = "full") -> Dict[str, Any]:
    """
    Function to analyze CSV data using the pandas library. Reads a CSV file, performs basic statistical analysis,
    generates visual charts, and saves the analysis report to disk.

    :param file_path: The path to the CSV file to be analyzed.
    :param report_size: The size/detail level of the report (e.g., "full", "summary").
                        (default is "full")
    :return: A dictionary containing analysis results such as summary statistics and data types.
    """

    # Initialize a dictionary to store analysis results
    analysis_results = {}

    # Check if the file exists
    csv_path = Path(file_path)
    if not csv_path.is_file():
        print(f"The file '{file_path}' does not exist.")
        return analysis_results

    try:
        # Read the CSV file into a pandas DataFrame
        df = pd.read_csv(csv_path)
        print(f"CSV file '{file_path}' successfully loaded.")
    except pd.errors.EmptyDataError:
        print(f"The file '{file_path}' is empty.")
        return analysis_results
    except pd.errors.ParserError:
        print(f"The file '{file_path}' is not a valid CSV.")
        return analysis_results
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return analysis_results

    # Basic analysis
    analysis_results['total_rows'] = len(df)
    analysis_results['total_columns'] = len(df.columns)
    analysis_results['columns'] = df.columns.tolist()
    analysis_results['data_types'] = df.dtypes.apply(lambda dt: dt.name).to_dict()
    analysis_results['missing_values'] = df.isnull().sum().to_dict()

    if report_size == "full":
        analysis_results['summary_statistics'] = df.describe(include='all').to_dict()
        analysis_results['unique_values'] = df.nunique().to_dict()
    elif report_size == "summary":
        analysis_results['summary_statistics'] = df.describe(include='all').to_dict()

    # Generate charts within the main function
    chart_files = []
    saved_files = []

    # Set the base directory for saving charts
    base_dir = Path("/home/ubuntu/.autogenstudio")
    chart_dir = base_dir / "charts"
    chart_dir.mkdir(parents=True, exist_ok=True)

    # Set the aesthetic style of the plots
    sns.set(style="whitegrid")

    for column in df.columns:
        # Generate histograms for numerical columns
        if pd.api.types.is_numeric_dtype(df[column]):
            plt.figure(figsize=(8, 6))
            sns.histplot(df[column].dropna(), kde=True, bins=30, color='skyblue')
            plt.title(f'Histogram of {column}')
            plt.xlabel(column)
            plt.ylabel('Frequency')
            chart_file = chart_dir / f"histogram_{column}_{uuid.uuid4()}.png"
            plt.savefig(chart_file)
            plt.close()
            chart_files.append(str(chart_file))
            print(f"Histogram for '{column}' saved to {chart_file}")

        # Generate bar charts for categorical columns
        elif pd.api.types.is_object_dtype(df[column]) or pd.api.types.is_categorical_dtype(df[column]):
            plt.figure(figsize=(10, 8))
            # Get the top 10 most frequent categories
            top_categories = df[column].value_counts().nlargest(10)
            sns.barplot(x=top_categories.values, y=top_categories.index, palette='viridis')
            plt.title(f'Bar Chart of {column} (Top 10)')
            plt.xlabel('Count')
            plt.ylabel(column)
            chart_file = chart_dir / f"barchart_{column}_{uuid.uuid4()}.png"
            plt.savefig(chart_file, bbox_inches='tight')
            plt.close()
            chart_files.append(str(chart_file))
            print(f"Bar chart for '{column}' saved to {chart_file}")

    # Adjust the paths to generate proper URLs
    for chart_file_path in chart_files:
        file_path = Path(chart_file_path)
        # Get the relative path with respect to the base directory
        relative_path = os.path.relpath(file_path.resolve(), base_dir)
        print(f"Relative path: {relative_path}")

        # Construct the URL
        image_url = f"https://api.wisdomprompt.com/api/{relative_path}"
        print(f"Image saved to {image_url}")

        saved_files.append(image_url)

    # Add the list of image URLs to the analysis results
    analysis_results['charts'] = saved_files

    # Generate a unique filename for the analysis report
    report_file_name = f"analysis_report_{uuid.uuid4()}.txt"
    report_path = Path(report_file_name)

    try:
        with open(report_path, "w") as report_file:
            report_file.write("CSV Data Analysis Report\n")
            report_file.write("========================\n\n")
            report_file.write(f"File: {file_path}\n")
            report_file.write(f"Total Rows: {analysis_results['total_rows']}\n")
            report_file.write(f"Total Columns: {analysis_results['total_columns']}\n\n")

            report_file.write("Column Data Types:\n")
            for column, dtype in analysis_results["data_types"].items():
                report_file.write(f" - {column}: {dtype}\n")
            report_file.write("\n")

            report_file.write("Missing Values:\n")
            for column, missing in analysis_results["missing_values"].items():
                report_file.write(f" - {column}: {missing}\n")
            report_file.write("\n")

            if 'summary_statistics' in analysis_results:
                report_file.write("Summary Statistics:\n")
                summary_df = pd.DataFrame(analysis_results['summary_statistics'])
                report_file.write(summary_df.to_string())
                report_file.write("\n\n")

            if 'unique_values' in analysis_results:
                report_file.write("Unique Values per Column:\n")
                for column, unique in analysis_results["unique_values"].items():
                    report_file.write(f" - {column}: {unique}\n")
                report_file.write("\n")

            if 'charts' in analysis_results:
                report_file.write("Generated Charts:\n")
                for chart in analysis_results['charts']:
                    report_file.write(f" - {chart}\n")
                report_file.write("\n")

        print(f"Analysis report saved to {report_path}")
    except Exception as e:
        print(f"Failed to write the analysis report: {e}")

    return analysis_results

# Example usage of the function:
# analysis = analyze_csv_data("data/sample_data.csv", report_size="full")
# print(analysis)
