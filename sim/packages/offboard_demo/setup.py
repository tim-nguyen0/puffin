from setuptools import find_packages, setup

package_name = "offboard_demo"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    description="Lifecycle node that flies the x500 in a 10 m square via offboard setpoints.",
    license="MIT",
    entry_points={
        "console_scripts": [
            "offboard_demo_node = offboard_demo.node:main",
            "mission_node = offboard_demo.mission_node:main",
            "teleop_node = offboard_demo.teleop:main",
            "forge_watcher = offboard_demo.forge_watcher:main",
            "dummy_flight = offboard_demo.dummy_flight:main",
        ],
    },
)
