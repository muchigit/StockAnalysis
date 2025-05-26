from setuptools import setup, find_packages

# Read the contents of your README file
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name='sec-filer-retriever',
    version='0.1.0',
    author='AI Assistant', # Placeholder
    author_email='assistant@example.com', # Placeholder
    description='A Python package to retrieve the latest SEC 10-K or 10-Q filing date for a given ticker symbol.',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/example/sec-filer-retriever', # Placeholder URL
    packages=find_packages(exclude=['tests*']),
    install_requires=[
        'sec-cik-mapper>=2.1.0', # Version installed was 2.1.0
        'requests>=2.20.0'     # A reasonable minimum for requests
    ],
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Topic :: Office/Business :: Financial :: Investment',
        'License :: OSI Approved :: MIT License', # Assuming MIT License
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.7',
)
